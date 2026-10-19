using IDS.Application.Reports;
using IDS.Domain.Calculations;
using IDS.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace IDS.Infrastructure.Persistence;

public sealed class EfIpfCompositionRepository(IdsDbContext dbContext, ICurrentUserScope userScope) : IIpfCompositionRepository
{
    public Task<Organization?> GetContractorAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Organizations.AsNoTracking().SingleOrDefaultAsync(value => value.Id == id, cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, string>> GetAreaNamesAsync(CancellationToken cancellationToken)
    {
        var names = await dbContext.InspectionAreas.AsNoTracking()
            .ToDictionaryAsync(area => area.Id, area => area.Name, cancellationToken);
        names[Guid.Empty] = InspectionArea.DefaultName;
        return names;
    }

    public async Task<IReadOnlyDictionary<Guid, IReadOnlyCollection<decimal?>>> GetScoresAsync(
        int year, int month, Guid contractorId, CancellationToken cancellationToken)
    {
        var start = new DateOnly(year, month, 1);
        var end = start.AddMonths(1);
        var evaluations = await dbContext.Evaluations.AsNoTracking()
            .Where(evaluation => userScope.IsAdministrator || evaluation.CreatedByUserId == userScope.UserId)
            .Where(evaluation => evaluation.ContractorOrganizationId == contractorId
                && evaluation.EvaluationDate >= start && evaluation.EvaluationDate < end)
            .Include(evaluation => evaluation.FormVersion)
            .Include(evaluation => evaluation.Observations).ThenInclude(observation => observation.SeverityLevel)
            .ToArrayAsync(cancellationToken);
        return evaluations.GroupBy(evaluation => evaluation.FormVersion?.AreaId ?? Guid.Empty)
            .ToDictionary(group => group.Key, group => (IReadOnlyCollection<decimal?>)group.Select(evaluation =>
                IdsCalculator.Calculate(evaluation.Observations.Select(observation =>
                    new ObservationInput(observation.Quantity, observation.SeverityLevel?.Weight)),
                    evaluation.ObservedPeople ?? 0m).Score).ToArray());
    }

    public async Task<IReadOnlyCollection<IpfComposition>> GetYearAsync(
        int year, Guid contractorId, CancellationToken cancellationToken) =>
        await dbContext.IpfCompositions.AsNoTracking().Include(record => record.Areas)
            .Where(record => record.Year == year && record.ContractorOrganizationId == contractorId)
            .ToArrayAsync(cancellationToken);

    public async Task<IpfComposition> UpsertAsync(IpfComposition snapshot, CancellationToken cancellationToken)
    {
        var existing = await dbContext.IpfCompositions.Include(record => record.Areas).SingleOrDefaultAsync(
            record => record.Year == snapshot.Year && record.Month == snapshot.Month
                && record.ContractorOrganizationId == snapshot.ContractorOrganizationId, cancellationToken);
        if (existing is null)
        {
            dbContext.IpfCompositions.Add(snapshot);
        }
        else
        {
            dbContext.IpfCompositionAreas.RemoveRange(existing.Areas);
            dbContext.IpfCompositionAreas.AddRange(snapshot.Areas);
            existing.Areas = snapshot.Areas;
            existing.Value = snapshot.Value;
            existing.ContractorName = snapshot.ContractorName;
            // An explicit recalculation must refresh the timestamp even when its score is unchanged.
            dbContext.Entry(existing).Property(record => record.Value).IsModified = true;
            snapshot = existing;
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        return snapshot;
    }
}
