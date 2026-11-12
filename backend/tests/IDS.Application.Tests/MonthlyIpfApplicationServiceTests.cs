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
    public async Task PreservesAreaAndFormContextInHistoryAndUpsertsIndependently()
    {
        var repository = new FakeMonthlyIpfRepository();
        var service = new MonthlyIpfApplicationService(repository);
        var areaId = Guid.NewGuid();
        var formId = Guid.NewGuid();

        var saved = await service.UpsertAsync(
            2026,
            10,
            new UpsertMonthlyIpfRequest(ContractorId, null, 8.37m, areaId, formId),
            CancellationToken.None);
        var defaultSaved = await service.UpsertAsync(
            2026,
            10,
            new UpsertMonthlyIpfRequest(ContractorId, null, 7.25m),
            CancellationToken.None);

        Assert.Equal(areaId, saved.AreaId);
        Assert.Equal(formId, saved.FormId);
        Assert.Null(defaultSaved.AreaId);
        Assert.Null(defaultSaved.FormId);
        Assert.Equal(2, repository.Records.Count);

        var history = await service.GetYearAsync(2026, ContractorId, CancellationToken.None, areaId, formId);
        Assert.Equal(areaId, history.AreaId);
        Assert.Equal(formId, history.FormId);
        Assert.Equal(areaId, Assert.Single(history.Months).AreaId);
        Assert.Equal(formId, Assert.Single(history.Months).FormId);
    }

    [Fact]
    public async Task TreatsEmptyAreaAndFormIdsAsTheCanonicalDefault()
    {
        var repository = new FakeMonthlyIpfRepository();
        var service = new MonthlyIpfApplicationService(repository);

        var saved = await service.UpsertAsync(
            2026,
            10,
            new UpsertMonthlyIpfRequest(ContractorId, null, 8.37m, Guid.Empty, Guid.Empty),
            CancellationToken.None);
        var history = await service.GetYearAsync(
            2026, ContractorId, CancellationToken.None, Guid.Empty, Guid.Empty);

        Assert.Null(saved.AreaId);
        Assert.Null(saved.FormId);
        Assert.Null(history.AreaId);
        Assert.Null(history.FormId);
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

    [Theory]
    [InlineData(0.8831, 0.8, 20, 6.2389)]
    [InlineData(0.8831, 1, 20, 7.2986)]
    [InlineData(0.8831, 0.8, 30, 7.2389)]
    [InlineData(0, 0.8, 20, 2)]
    [InlineData(-0.8831, 0.8, 0, -4.2389)]
    public async Task CalculatesIpfFromIdsPercentageAndPersistsBothOperands(
        decimal average, decimal factor, decimal additional, decimal expected)
    {
        var repository = new FakeMonthlyIpfRepository();
        repository.MonthlyEvaluationScores.AddRange([average, null, average]);
        var service = new MonthlyIpfApplicationService(repository);
        var saved = await service.UpsertAsync(2026, 10,
            new UpsertMonthlyIpfRequest(ContractorId, null, 999m,
                MultiplicationFactor: factor, AdditionalScore: additional), CancellationToken.None);
        var reloaded = Assert.Single((await service.GetYearAsync(2026, ContractorId, CancellationToken.None)).Months);

        Assert.Equal(expected, saved.Value);
        Assert.Equal(expected, reloaded.Value);
        Assert.Equal(factor, reloaded.MultiplicationFactor);
        Assert.Equal(additional, reloaded.AdditionalScore);
        Assert.Equal("Formula", saved.Source);
        Assert.Null(repository.RequestedSiteId);
    }

    [Fact]
    public async Task CalculatesUsingAllScoresWithoutIntermediateRounding()
    {
        var repository = new FakeMonthlyIpfRepository();
        repository.MonthlyEvaluationScores.AddRange(Enumerable.Repeat<decimal?>(0.1234567m, 251));
        repository.MonthlyEvaluationScores.Add(0.9999999m);
        var service = new MonthlyIpfApplicationService(repository);

        var saved = await service.UpsertAsync(2026, 10,
            new UpsertMonthlyIpfRequest(ContractorId, null, 0m,
                MultiplicationFactor: 0.8m, AdditionalScore: 20m), CancellationToken.None);

        var expected = decimal.Round(((251m * 0.1234567m + 0.9999999m) / 252m * 60m * 0.8m + 20m) / 10m, 4);
        Assert.Equal(expected, saved.Value);
    }

    [Theory]
    [InlineData(false, true)]
    [InlineData(true, false)]
    [InlineData(true, true)]
    public async Task RejectsIncompleteFormulaOrMissingIds(bool hasFactor, bool hasAdditional)
    {
        var repository = new FakeMonthlyIpfRepository();
        var service = new MonthlyIpfApplicationService(repository);

        await Assert.ThrowsAsync<IpfReportValidationException>(() => service.UpsertAsync(2026, 10,
            new UpsertMonthlyIpfRequest(ContractorId, null, 0m,
                MultiplicationFactor: hasFactor ? 0.8m : null,
                AdditionalScore: hasAdditional ? 20m : null), CancellationToken.None));

        Assert.Empty(repository.Records);
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
        public Guid? RequestedSiteId { get; private set; }

        public Task<Organization?> GetContractorAsync(Guid contractorId, CancellationToken cancellationToken) =>
            Task.FromResult<Organization?>(contractorId == ContractorId ? CreateContractor() : null);

        public Task<bool> SiteExistsAsync(Guid siteId, CancellationToken cancellationToken) => Task.FromResult(true);

        public Task<(string AreaName, string FormName)> ValidateScopeAsync(
            Guid? areaId,
            Guid? formId,
            CancellationToken cancellationToken) =>
            Task.FromResult((IDS.Domain.Entities.InspectionArea.DefaultName, "Formulário padrão"));

        public Task<IReadOnlyCollection<MonthlyIpfRecord>> GetYearAsync(
            int year,
            Guid contractorId,
            CancellationToken cancellationToken,
            Guid? areaId = null,
            Guid? formId = null) =>
            Task.FromResult<IReadOnlyCollection<MonthlyIpfRecord>>(Records
                .Where(record => record.Year == year
                    && record.ContractorOrganizationId == contractorId
                    && record.AreaId == (areaId == Guid.Empty ? null : areaId)
                    && record.FormId == (formId == Guid.Empty ? null : formId))
                .ToArray());

        public Task<IReadOnlyCollection<decimal?>> GetMonthlyEvaluationScoresAsync(
            int year,
            int month,
            Guid contractorId,
            CancellationToken cancellationToken,
            Guid? areaId = null,
            Guid? formId = null,
            Guid? siteId = null)
        {
            RequestedSiteId = siteId;
            return Task.FromResult<IReadOnlyCollection<decimal?>>(MonthlyEvaluationScores);
        }

        public Task<MonthlyIpfRecord> UpsertAsync(
            int year,
            int month,
            UpsertMonthlyIpfRequest request,
            CancellationToken cancellationToken)
        {
            var record = Records.SingleOrDefault(value => value.Year == year
                && value.Month == month
                && value.ContractorOrganizationId == request.ContractorOrganizationId
                && value.AreaId == request.AreaId
                && value.FormId == request.FormId);
            if (record is null)
            {
                record = new MonthlyIpfRecord
                {
                    Id = Guid.NewGuid(),
                    Year = year,
                    Month = month,
                    ContractorOrganizationId = request.ContractorOrganizationId,
                    AreaId = request.AreaId,
                    FormId = request.FormId,
                    ContractorOrganization = CreateContractor()
                };
                Records.Add(record);
            }

            record.SiteId = request.SiteId;
            record.Value = request.Value;
            record.MultiplicationFactor = request.MultiplicationFactor;
            record.AdditionalScore = request.AdditionalScore;
            record.Source = request.MultiplicationFactor.HasValue ? "Formula" : "Manual";
            return Task.FromResult(record);
        }
    }
}
