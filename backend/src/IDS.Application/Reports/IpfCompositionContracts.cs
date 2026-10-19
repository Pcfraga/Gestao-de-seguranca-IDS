using IDS.Domain.Entities;

namespace IDS.Application.Reports;

public sealed record IpfCompositionAreaRequest(Guid? AreaId, decimal? Weight);
public sealed record IpfCompositionRequest(Guid? ContractorOrganizationId, IReadOnlyCollection<IpfCompositionAreaRequest?>? Areas);
public sealed record CompositionAreaDto(
    Guid AreaId, string AreaName, decimal Weight, decimal EffectiveWeight, decimal? Average,
    int EvaluationCount, int ScoredEvaluationCount, decimal? Contribution, string Status);
public sealed record CompositionDto(
    Guid? Id, int Year, int Month, Guid ContractorOrganizationId, string Contractor, decimal? Value,
    IReadOnlyCollection<CompositionAreaDto> Areas, DateTimeOffset? UpdatedAtUtc);
public sealed record IpfCompositionYearDto(
    int Year, Guid ContractorOrganizationId, string Contractor, decimal? AnnualAverage,
    IReadOnlyCollection<CompositionDto> Months);

public interface IIpfCompositionRepository
{
    Task<Organization?> GetContractorAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyDictionary<Guid, string>> GetAreaNamesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyDictionary<Guid, IReadOnlyCollection<decimal?>>> GetScoresAsync(
        int year, int month, Guid contractorId, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<IpfComposition>> GetYearAsync(int year, Guid contractorId, CancellationToken cancellationToken);
    Task<IpfComposition> UpsertAsync(IpfComposition snapshot, CancellationToken cancellationToken);
}
