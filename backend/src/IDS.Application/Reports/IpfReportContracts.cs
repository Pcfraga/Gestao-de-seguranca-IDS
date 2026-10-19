using IDS.Domain.Entities;

namespace IDS.Application.Reports;

public sealed record UpsertMonthlyIpfRequest(
    Guid ContractorOrganizationId,
    Guid? SiteId,
    decimal Value,
    Guid? AreaId = null,
    Guid? FormId = null);

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
    DateTimeOffset UpdatedAtUtc,
    Guid? AreaId = null,
    Guid? FormId = null);

public sealed record IpfAnnualHistoryDto(
    int Year,
    Guid ContractorOrganizationId,
    string Contractor,
    decimal? AnnualAverage,
    IReadOnlyCollection<MonthlyIpfValueDto> Months,
    Guid? AreaId = null,
    Guid? FormId = null,
    string AreaName = InspectionArea.DefaultName,
    string FormName = "Formulário padrão");

public sealed record MonthlyIpfSuggestionDto(
    int Year,
    int Month,
    Guid ContractorOrganizationId,
    decimal? Average,
    int EvaluationCount,
    int ScoredEvaluationCount,
    Guid? AreaId = null,
    Guid? FormId = null);

public sealed class IpfReportValidationException(IReadOnlyCollection<string> errors)
    : Exception("Os dados do relatório IPF são inválidos.")
{
    public IReadOnlyCollection<string> Errors { get; } = errors;
}