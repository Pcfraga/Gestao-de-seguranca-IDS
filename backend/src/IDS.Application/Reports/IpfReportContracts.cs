namespace IDS.Application.Reports;

public sealed record UpsertMonthlyIpfRequest(
    Guid ContractorOrganizationId,
    Guid? SiteId,
    decimal Value);

public sealed record MonthlyIpfValueDto(
    Guid Id,
    int Year,
    int Month,
    Guid ContractorOrganizationId,
    string Contractor,
    Guid? SiteId,
    string? Site,
    decimal Value,
    string Source,
    DateTimeOffset UpdatedAtUtc);

public sealed record IpfAnnualHistoryDto(
    int Year,
    Guid ContractorOrganizationId,
    string Contractor,
    decimal? AnnualAverage,
    IReadOnlyCollection<MonthlyIpfValueDto> Months);

public sealed record MonthlyIpfSuggestionDto(
    int Year,
    int Month,
    Guid ContractorOrganizationId,
    decimal? Average,
    int EvaluationCount,
    int ScoredEvaluationCount);

public sealed class IpfReportValidationException(IReadOnlyCollection<string> errors)
    : Exception("Os dados do relatório IPF são inválidos.")
{
    public IReadOnlyCollection<string> Errors { get; } = errors;
}