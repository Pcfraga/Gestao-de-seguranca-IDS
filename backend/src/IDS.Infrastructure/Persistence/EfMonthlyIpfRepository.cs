using IDS.Application.Reports;
using IDS.Domain.Calculations;
using IDS.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace IDS.Infrastructure.Persistence;

public sealed class EfMonthlyIpfRepository(IdsDbContext dbContext) : IMonthlyIpfRepository
{
    public Task<Organization?> GetContractorAsync(Guid contractorId, CancellationToken cancellationToken) =>
        dbContext.Organizations.AsNoTracking()
            .SingleOrDefaultAsync(organization => organization.Id == contractorId, cancellationToken);

    public Task<bool> SiteExistsAsync(Guid siteId, CancellationToken cancellationToken) =>
        dbContext.Sites.AsNoTracking().AnyAsync(site => site.Id == siteId, cancellationToken);

    public async Task<IReadOnlyCollection<MonthlyIpfRecord>> GetYearAsync(
        int year,
        Guid contractorId,
        CancellationToken cancellationToken) =>
        await dbContext.MonthlyIpfRecords
            .AsNoTracking()
            .Include(record => record.ContractorOrganization)
            .Include(record => record.Site)
            .Where(record => record.Year == year && record.ContractorOrganizationId == contractorId)
            .OrderBy(record => record.Month)
            .ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyCollection<decimal?>> GetMonthlyEvaluationScoresAsync(
        int year,
        int month,
        Guid contractorId,
        CancellationToken cancellationToken)
    {
        var monthStart = new DateOnly(year, month, 1);
        var nextMonthStart = month == 12
            ? new DateOnly(year + 1, 1, 1)
            : new DateOnly(year, month + 1, 1);
        var evaluations = await dbContext.Evaluations
            .AsNoTracking()
            .Where(evaluation => evaluation.ContractorOrganizationId == contractorId
                && evaluation.EvaluationDate >= monthStart
                && evaluation.EvaluationDate < nextMonthStart)
            .Include(evaluation => evaluation.Observations)
                .ThenInclude(observation => observation.SeverityLevel)
            .ToArrayAsync(cancellationToken);

        return evaluations.Select(evaluation => IdsCalculator.Calculate(
            evaluation.Observations.Select(observation => new ObservationInput(
                observation.Quantity,
                observation.SeverityLevel?.Weight)),
            evaluation.ObservedPeople ?? 0m).Score).ToArray();
    }

    public async Task<MonthlyIpfRecord> UpsertAsync(
        int year,
        int month,
        UpsertMonthlyIpfRequest request,
        CancellationToken cancellationToken)
    {
        var record = await dbContext.MonthlyIpfRecords
            .Include(value => value.ContractorOrganization)
            .Include(value => value.Site)
            .SingleOrDefaultAsync(value => value.Year == year
                && value.Month == month
                && value.ContractorOrganizationId == request.ContractorOrganizationId, cancellationToken);

        if (record is null)
        {
            record = new MonthlyIpfRecord
            {
                Year = year,
                Month = month,
                ContractorOrganizationId = request.ContractorOrganizationId,
                ContractorOrganization = await dbContext.Organizations.SingleAsync(
                    organization => organization.Id == request.ContractorOrganizationId,
                    cancellationToken)
            };
            dbContext.MonthlyIpfRecords.Add(record);
        }

        record.SiteId = request.SiteId;
        record.Site = request.SiteId is Guid siteId
            ? await dbContext.Sites.SingleAsync(site => site.Id == siteId, cancellationToken)
            : null;
        record.Value = request.Value;
        record.Source = "Manual";
        await dbContext.SaveChangesAsync(cancellationToken);
        return record;
    }
}