using IDS.Domain.Calculations;
using IDS.Domain.Entities;

namespace IDS.Application.Evaluations;

public sealed record EvaluationReferenceData(
    IReadOnlyDictionary<Guid, ChecklistItem> Items,
    IReadOnlyDictionary<Guid, SeverityLevel> Severities,
    IReadOnlyDictionary<Guid, Site> Sites,
    IReadOnlyDictionary<Guid, Organization> Organizations);

public sealed record EvaluationPeriodTotals(
    int EvaluationCount,
    decimal? ObservedPeopleTotal,
    decimal TotalDeviations,
    decimal LowSeverityDeviations,
    decimal MediumSeverityDeviations,
    decimal HighSeverityDeviations);

public sealed record EvaluationTrendRecord(
    Guid Id,
    DateOnly EvaluationDate,
    decimal? ObservedPeople,
    IReadOnlyCollection<ObservationInput> Observations);

public sealed record ConsolidationRecord(
    Guid EvaluationId,
    DateOnly EvaluationDate,
    decimal? ObservedPeople,
    IReadOnlyCollection<ConsolidationObservationRecord> Observations);

public sealed record ConsolidationObservationRecord(
    string CategoryCode,
    string CategoryName,
    string ItemCode,
    string ItemName,
    decimal? Quantity,
    decimal? SeverityWeight);

public interface IEvaluationRepository
{
    Task<EvaluationReferenceData> LoadReferenceDataAsync(
        CreateEvaluationRequest request,
        CancellationToken cancellationToken);

    Task AddAsync(Evaluation evaluation, CancellationToken cancellationToken);

    Task<Evaluation?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    Task<Evaluation?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);

    Task<IReadOnlyCollection<Evaluation>> GetManyAsync(
        DateOnly? from,
        DateOnly? to,
        Guid? siteId,
        Guid? contractorId,
        CancellationToken cancellationToken);

    Task<EvaluationPeriodTotals> GetPeriodTotalsAsync(
        DateOnly? from,
        DateOnly? to,
        Guid? siteId,
        Guid? contractorId,
        CancellationToken cancellationToken);

    Task<IReadOnlyCollection<EvaluationTrendRecord>> GetTrendRecordsAsync(
        DateOnly? from,
        DateOnly? to,
        Guid? siteId,
        Guid? contractorId,
        CancellationToken cancellationToken);

    Task<IReadOnlyCollection<ConsolidationRecord>> GetConsolidationRecordsAsync(
        DateOnly? from,
        DateOnly? to,
        Guid? siteId,
        Guid? contractorId,
        CancellationToken cancellationToken);
}