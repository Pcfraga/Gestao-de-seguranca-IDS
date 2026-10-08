using IDS.Application.Reports;
using IDS.Domain.Entities;

namespace IDS.Application.Tests;

public sealed class MonthlyIpfApplicationServiceTests
{
    private static readonly Guid ContractorId = Guid.NewGuid();

    [Fact]
    public async Task ReturnsAnnualAverageAcrossRecordedMonthsOnly()
    {
        var repository = new FakeMonthlyIpfRepository();
        repository.Records.Add(CreateRecord(2, 8.1m));
        repository.Records.Add(CreateRecord(4, 7.5m));
        var service = new MonthlyIpfApplicationService(repository);

        var history = await service.GetYearAsync(2026, ContractorId, CancellationToken.None);

        Assert.Equal("Contratada teste", history.Contractor);
        Assert.Equal(7.8m, history.AnnualAverage);
        Assert.Equal(new[] { 2, 4 }, history.Months.Select(value => value.Month));
    }

    [Fact]
    public async Task UpsertsMonthlyValueForTheSelectedContractor()
    {
        var repository = new FakeMonthlyIpfRepository();
        var service = new MonthlyIpfApplicationService(repository);

        var saved = await service.UpsertAsync(
            2026,
            10,
            new UpsertMonthlyIpfRequest(ContractorId, null, 8.37m),
            CancellationToken.None);

        Assert.Equal(2026, saved.Year);
        Assert.Equal(10, saved.Month);
        Assert.Equal(ContractorId, saved.ContractorOrganizationId);
        Assert.Equal(8.37m, saved.Value);
        Assert.Single(repository.Records);
    }

    [Fact]
    public async Task SuggestsTheAverageOfScoredEvaluationsForTheSelectedMonth()
    {
        var repository = new FakeMonthlyIpfRepository();
        repository.MonthlyEvaluationScores.AddRange([0.8m, 0.6m, null]);
        var service = new MonthlyIpfApplicationService(repository);

        var suggestion = await service.GetMonthlySuggestionAsync(2026, 10, ContractorId, CancellationToken.None);

        Assert.Equal(2026, suggestion.Year);
        Assert.Equal(10, suggestion.Month);
        Assert.Equal(ContractorId, suggestion.ContractorOrganizationId);
        Assert.Equal(0.7m, suggestion.Average);
        Assert.Equal(3, suggestion.EvaluationCount);
        Assert.Equal(2, suggestion.ScoredEvaluationCount);
    }

    [Fact]
    public async Task ReturnsNoAverageWhenTheMonthHasNoScoredEvaluations()
    {
        var service = new MonthlyIpfApplicationService(new FakeMonthlyIpfRepository());

        var suggestion = await service.GetMonthlySuggestionAsync(2026, 10, ContractorId, CancellationToken.None);

        Assert.Null(suggestion.Average);
        Assert.Equal(0, suggestion.EvaluationCount);
        Assert.Equal(0, suggestion.ScoredEvaluationCount);
    }

    private static MonthlyIpfRecord CreateRecord(int month, decimal value) => new()
    {
        Id = Guid.NewGuid(),
        Year = 2026,
        Month = month,
        ContractorOrganizationId = ContractorId,
        ContractorOrganization = CreateContractor(),
        Value = value,
        Source = "Manual"
    };

    private static Organization CreateContractor() => new()
    {
        Id = ContractorId,
        Name = "Contratada teste",
        Kind = OrganizationKind.Contractor
    };

    private sealed class FakeMonthlyIpfRepository : IMonthlyIpfRepository
    {
        public List<MonthlyIpfRecord> Records { get; } = [];
        public List<decimal?> MonthlyEvaluationScores { get; } = [];

        public Task<Organization?> GetContractorAsync(Guid contractorId, CancellationToken cancellationToken) =>
            Task.FromResult<Organization?>(contractorId == ContractorId ? CreateContractor() : null);

        public Task<bool> SiteExistsAsync(Guid siteId, CancellationToken cancellationToken) => Task.FromResult(true);

        public Task<IReadOnlyCollection<MonthlyIpfRecord>> GetYearAsync(
            int year,
            Guid contractorId,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyCollection<MonthlyIpfRecord>>(Records
                .Where(record => record.Year == year && record.ContractorOrganizationId == contractorId)
                .ToArray());

        public Task<IReadOnlyCollection<decimal?>> GetMonthlyEvaluationScoresAsync(
            int year,
            int month,
            Guid contractorId,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyCollection<decimal?>>(MonthlyEvaluationScores);

        public Task<MonthlyIpfRecord> UpsertAsync(
            int year,
            int month,
            UpsertMonthlyIpfRequest request,
            CancellationToken cancellationToken)
        {
            var record = Records.SingleOrDefault(value => value.Year == year
                && value.Month == month
                && value.ContractorOrganizationId == request.ContractorOrganizationId);
            if (record is null)
            {
                record = new MonthlyIpfRecord
                {
                    Id = Guid.NewGuid(),
                    Year = year,
                    Month = month,
                    ContractorOrganizationId = request.ContractorOrganizationId,
                    ContractorOrganization = CreateContractor()
                };
                Records.Add(record);
            }

            record.SiteId = request.SiteId;
            record.Value = request.Value;
            record.Source = "Manual";
            return Task.FromResult(record);
        }
    }
}
