using IDS.Domain.Entities;

namespace IDS.Application.Reports;

public interface IMonthlyIpfRepository
{
    Task<Organization?> GetContractorAsync(Guid contractorId, CancellationToken cancellationToken);

    Task<bool> SiteExistsAsync(Guid siteId, CancellationToken cancellationToken);

    Task<IReadOnlyCollection<MonthlyIpfRecord>> GetYearAsync(
        int year,
        Guid contractorId,
        CancellationToken cancellationToken);

    Task<IReadOnlyCollection<decimal?>> GetMonthlyEvaluationScoresAsync(
        int year,
        int month,
        Guid contractorId,
        CancellationToken cancellationToken);

    Task<MonthlyIpfRecord> UpsertAsync(
        int year,
        int month,
        UpsertMonthlyIpfRequest request,
        CancellationToken cancellationToken);
}