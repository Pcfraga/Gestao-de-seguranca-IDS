using IDS.Domain.Entities;

namespace IDS.Application.Reports;

public interface IMonthlyIpfRepository
{
    Task<Organization?> GetContractorAsync(Guid contractorId, CancellationToken cancellationToken);

    Task<bool> SiteExistsAsync(Guid siteId, CancellationToken cancellationToken);

    Task<Guid?> ResolveSiteIdAsync(Guid siteId, CancellationToken cancellationToken);

    Task<ProjectIdsAverageDto?> GetProjectAverageAsync(int year, int month, Guid contractorId, Guid siteId, CancellationToken cancellationToken);

    Task<AssociateLegacyIpfResult> AssociateLegacyAsync(Guid contractorId, Guid siteId, CancellationToken cancellationToken);

    Task<IReadOnlyCollection<MonthlyIpfRecord>> GetYearAsync(
        int year,
        Guid contractorId,
        CancellationToken cancellationToken,
        Guid? areaId = null,
        Guid? formId = null,
        Guid? siteId = null);

    Task<IReadOnlyCollection<decimal?>> GetMonthlyEvaluationScoresAsync(
        int year,
        int month,
        Guid contractorId,
        CancellationToken cancellationToken,
        Guid? areaId = null,
        Guid? formId = null,
        Guid? siteId = null);

    Task<decimal?> GetDisciplineAverageAsync(
        int year,
        int month,
        Guid contractorId,
        CancellationToken cancellationToken);

    Task<(string AreaName, string FormName)> ValidateScopeAsync(
        Guid? areaId,
        Guid? formId,
        CancellationToken cancellationToken);

    Task<MonthlyIpfRecord> UpsertAsync(
        int year,
        int month,
        UpsertMonthlyIpfRequest request,
        CancellationToken cancellationToken,
        decimal? idsAverage = null);
}