using IDS.Application.Evaluations;
using IDS.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace IDS.Infrastructure.Persistence;

public sealed class EfEvaluationRepository(IdsDbContext dbContext) : IEvaluationRepository
{
    public async Task<EvaluationReferenceData> LoadReferenceDataAsync(
        CreateEvaluationRequest request,
        CancellationToken cancellationToken)
    {
        var itemIds = request.Observations.Select(observation => observation.ChecklistItemId).Distinct().ToArray();
        var severityIds = request.Observations
            .Where(observation => observation.SeverityLevelId.HasValue)
            .Select(observation => observation.SeverityLevelId!.Value)
            .Distinct()
            .ToArray();
        var organizationIds = new[]
        {
            request.ClientOrganizationId,
            request.ContractorOrganizationId,
            request.SubcontractorOrganizationId
        }.Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToArray();

        var items = await dbContext.ChecklistItems
            .Include(item => item.Category)
            .Where(item => itemIds.Contains(item.Id) && item.IsActive)
            .ToDictionaryAsync(item => item.Id, cancellationToken);
        var severities = await dbContext.SeverityLevels
            .Where(severity => severityIds.Contains(severity.Id))
            .ToDictionaryAsync(severity => severity.Id, cancellationToken);
        var sites = request.SiteId is Guid siteId
            ? await dbContext.Sites.Where(site => site.Id == siteId).ToDictionaryAsync(site => site.Id, cancellationToken)
            : new Dictionary<Guid, Site>();
        var organizations = organizationIds.Length == 0
            ? new Dictionary<Guid, Organization>()
            : await dbContext.Organizations
                .Where(organization => organizationIds.Contains(organization.Id))
                .ToDictionaryAsync(organization => organization.Id, cancellationToken);

        return new EvaluationReferenceData(items, severities, sites, organizations);
    }

    public async Task AddAsync(Evaluation evaluation, CancellationToken cancellationToken)
    {
        dbContext.Evaluations.Add(evaluation);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public Task<Evaluation?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        QueryDetails().SingleOrDefaultAsync(evaluation => evaluation.Id == id, cancellationToken);

    public Task<Evaluation?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken) =>
        QueryDetails(asNoTracking: false).SingleOrDefaultAsync(evaluation => evaluation.Id == id, cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        dbContext.SaveChangesAsync(cancellationToken);

    public async Task<IReadOnlyCollection<Evaluation>> GetManyAsync(
        DateOnly? from,
        DateOnly? to,
        Guid? siteId,
        Guid? contractorId,
        CancellationToken cancellationToken)
    {
        var query = QueryDetails();
        if (from.HasValue)
        {
            query = query.Where(evaluation => evaluation.EvaluationDate >= from.Value);
        }

        if (to.HasValue)
        {
            query = query.Where(evaluation => evaluation.EvaluationDate <= to.Value);
        }

        if (siteId.HasValue)
        {
            query = query.Where(evaluation => evaluation.SiteId == siteId.Value);
        }

        if (contractorId.HasValue)
        {
            query = query.Where(evaluation => evaluation.ContractorOrganizationId == contractorId.Value);
        }

        return await query
            .OrderByDescending(evaluation => evaluation.EvaluationDate)
            .ThenByDescending(evaluation => evaluation.CreatedAtUtc)
            .Take(200)
            .ToArrayAsync(cancellationToken);
    }

    public async Task<EvaluationPeriodTotals> GetPeriodTotalsAsync(
        DateOnly? from,
        DateOnly? to,
        Guid? siteId,
        Guid? contractorId,
        CancellationToken cancellationToken)
    {
        var evaluations = dbContext.Evaluations.AsNoTracking();
        if (from.HasValue)
        {
            evaluations = evaluations.Where(evaluation => evaluation.EvaluationDate >= from.Value);
        }

        if (to.HasValue)
        {
            evaluations = evaluations.Where(evaluation => evaluation.EvaluationDate <= to.Value);
        }

        if (siteId.HasValue)
        {
            evaluations = evaluations.Where(evaluation => evaluation.SiteId == siteId.Value);
        }

        if (contractorId.HasValue)
        {
            evaluations = evaluations.Where(evaluation => evaluation.ContractorOrganizationId == contractorId.Value);
        }

        var evaluationCount = await evaluations.CountAsync(cancellationToken);
        var observedPeopleTotal = await evaluations
            .Where(evaluation => evaluation.ObservedPeople.HasValue)
            .Select(evaluation => evaluation.ObservedPeople)
            .SumAsync(cancellationToken);

        var observations = dbContext.EvaluationObservations
            .AsNoTracking()
            .Where(observation => observation.Quantity.HasValue)
            .Where(observation => observation.SeverityLevel != null
                && (observation.SeverityLevel.Weight == 0.3m
                    || observation.SeverityLevel.Weight == 1m
                    || observation.SeverityLevel.Weight == 3m))
            .Where(observation => evaluations.Any(evaluation => evaluation.Id == observation.EvaluationId));
        var lowSeverityDeviations = await observations
            .Where(observation => observation.SeverityLevel!.Weight == 0.3m)
            .SumAsync(observation => observation.Quantity ?? 0m, cancellationToken);
        var mediumSeverityDeviations = await observations
            .Where(observation => observation.SeverityLevel!.Weight == 1m)
            .SumAsync(observation => observation.Quantity ?? 0m, cancellationToken);
        var highSeverityDeviations = await observations
            .Where(observation => observation.SeverityLevel!.Weight == 3m)
            .SumAsync(observation => observation.Quantity ?? 0m, cancellationToken);
        var totalDeviations = lowSeverityDeviations + mediumSeverityDeviations + highSeverityDeviations;

        return new EvaluationPeriodTotals(
            evaluationCount,
            observedPeopleTotal,
            totalDeviations,
            lowSeverityDeviations,
            mediumSeverityDeviations,
            highSeverityDeviations);
    }

    public async Task<IReadOnlyCollection<EvaluationTrendRecord>> GetTrendRecordsAsync(
        DateOnly? from,
        DateOnly? to,
        Guid? siteId,
        Guid? contractorId,
        CancellationToken cancellationToken)
    {
        var query = QueryDetails();
        if (from.HasValue)
        {
            query = query.Where(evaluation => evaluation.EvaluationDate >= from.Value);
        }

        if (to.HasValue)
        {
            query = query.Where(evaluation => evaluation.EvaluationDate <= to.Value);
        }

        if (siteId.HasValue)
        {
            query = query.Where(evaluation => evaluation.SiteId == siteId.Value);
        }

        if (contractorId.HasValue)
        {
            query = query.Where(evaluation => evaluation.ContractorOrganizationId == contractorId.Value);
        }

        var evaluations = await query
            .OrderBy(evaluation => evaluation.EvaluationDate)
            .ThenBy(evaluation => evaluation.CreatedAtUtc)
            .ToArrayAsync(cancellationToken);

        return evaluations.Select(evaluation => new EvaluationTrendRecord(
            evaluation.Id,
            evaluation.EvaluationDate,
            evaluation.ObservedPeople,
            evaluation.Observations.Select(observation => new IDS.Domain.Calculations.ObservationInput(
                observation.Quantity,
                observation.SeverityLevel?.Weight)).ToArray())).ToArray();
    }

    public async Task<IReadOnlyCollection<ConsolidationRecord>> GetConsolidationRecordsAsync(
        DateOnly? from,
        DateOnly? to,
        Guid? siteId,
        Guid? contractorId,
        CancellationToken cancellationToken)
    {
        var query = QueryDetails();
        if (from.HasValue) query = query.Where(evaluation => evaluation.EvaluationDate >= from.Value);
        if (to.HasValue) query = query.Where(evaluation => evaluation.EvaluationDate <= to.Value);
        if (siteId.HasValue) query = query.Where(evaluation => evaluation.SiteId == siteId.Value);
        if (contractorId.HasValue) query = query.Where(evaluation => evaluation.ContractorOrganizationId == contractorId.Value);

        var evaluations = await query
            .OrderBy(evaluation => evaluation.EvaluationDate)
            .ThenBy(evaluation => evaluation.CreatedAtUtc)
            .ToArrayAsync(cancellationToken);

        return evaluations.Select(evaluation => new ConsolidationRecord(
            evaluation.Id,
            evaluation.EvaluationDate,
            evaluation.ObservedPeople,
            evaluation.Observations.Select(observation => new ConsolidationObservationRecord(
                observation.ChecklistItem.Category.Code,
                observation.ChecklistItem.Category.Name,
                observation.ChecklistItem.Code,
                observation.ChecklistItem.Name,
                observation.Quantity,
                observation.SeverityLevel?.Weight)).ToArray())).ToArray();
    }

    private IQueryable<Evaluation> QueryDetails(bool asNoTracking = true)
    {
        var query = asNoTracking ? dbContext.Evaluations.AsNoTracking() : dbContext.Evaluations;
        return query
        .Include(evaluation => evaluation.Site)
        .Include(evaluation => evaluation.ClientOrganization)
        .Include(evaluation => evaluation.ContractorOrganization)
        .Include(evaluation => evaluation.SubcontractorOrganization)
        .Include(evaluation => evaluation.Observations)
            .ThenInclude(observation => observation.ChecklistItem)
                .ThenInclude(item => item.Category)
        .Include(evaluation => evaluation.Observations)
            .ThenInclude(observation => observation.SeverityLevel);
    }
}