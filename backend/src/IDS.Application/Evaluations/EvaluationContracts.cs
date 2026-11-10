namespace IDS.Application.Evaluations;

public sealed record EvaluationObservationRequest(
    Guid ChecklistItemId,
    decimal? Quantity,
    Guid? SeverityLevelId,
    string? Comment);

public sealed record CreateEvaluationRequest(
    DateOnly EvaluationDate,
    TimeOnly? EvaluationTime,
    Guid? SiteId,
    Guid? ClientOrganizationId,
    Guid? ContractorOrganizationId,
    Guid? SubcontractorOrganizationId,
    string? LeadAuditorName,
    string? AuditorName,
    string? CompanionName,
    decimal? ObservedPeople,
    string? Strengths,
    string? ImprovementOpportunities,
    IReadOnlyCollection<EvaluationObservationRequest> Observations,
    Guid? FormVersionId = null);

public sealed record EvaluationObservationDto(
    Guid ChecklistItemId,
    string Category,
    string Item,
    decimal? Quantity,
    decimal? SeverityWeight,
    string? Comment,
    bool HasIncompletePair);

public sealed record EvaluationIndicatorsDto(
    decimal? ObservedPeople,
    decimal TotalDeviations,
    decimal WeightedDeviationTotal,
    decimal? Ids,
    decimal? LowSeverityShare,
    decimal? MediumSeverityShare,
    decimal? HighSeverityShare);

public sealed record DashboardSummaryDto(
    int EvaluationCount,
    decimal? ObservedPeopleTotal,
    decimal TotalDeviations,
    decimal LowSeverityDeviations,
    decimal MediumSeverityDeviations,
    decimal HighSeverityDeviations,
    decimal? LowSeverityShare,
    decimal? MediumSeverityShare,
    decimal? HighSeverityShare,
    decimal? Ids,
    string IdsStatus,
    IReadOnlyCollection<DashboardTrendPointDto> Trend);

public sealed record DashboardTrendPointDto(Guid EvaluationId, DateOnly Date, decimal? Ids, Guid? SiteId);

public sealed record ConsolidationCategoryDto(string Code, string Name, decimal Quantity);

public sealed record ConsolidationItemDto(string CategoryCode, string Category, string Code, string Name, decimal Quantity);

public sealed record ConsolidationDayDto(
    DateOnly Date,
    int EvaluationCount,
    decimal ObservedPeople,
    decimal TotalDeviations,
    decimal WeightedDeviationTotal,
    decimal LowSeverityDeviations,
    decimal MediumSeverityDeviations,
    decimal HighSeverityDeviations);

public sealed record ConsolidationWeekdayDto(
    int WeekNumber,
    int DayOfWeek,
    int EvaluationCount,
    decimal ObservedPeople,
    decimal TotalDeviations,
    decimal WeightedDeviationTotal,
    decimal LowSeverityDeviations,
    decimal MediumSeverityDeviations,
    decimal HighSeverityDeviations,
    decimal? Ids);

public sealed record ConsolidationWeekCategoryDto(int WeekNumber, string Code, string Name, decimal Quantity);

public sealed record ConsolidationWeekItemDto(
    int WeekNumber,
    string CategoryCode,
    string Category,
    string Code,
    string Name,
    decimal Quantity);

public sealed record ConsolidationReportMetadataDto(
    IReadOnlyCollection<string> ProjectOrIslands,
    IReadOnlyCollection<string> Sites,
    IReadOnlyCollection<string> Clients,
    IReadOnlyCollection<string> Evaluators,
    IReadOnlyCollection<ConsolidationReportMetadataBySiteDto> BySite);

public sealed record ConsolidationReportMetadataBySiteDto(
    Guid? SiteId,
    IReadOnlyCollection<string> ProjectOrIslands,
    IReadOnlyCollection<string> Sites,
    IReadOnlyCollection<string> Clients,
    IReadOnlyCollection<string> Evaluators);

public sealed record DataConsolidationDto(
    DateOnly? From,
    DateOnly? To,
    int EvaluationCount,
    decimal ObservedPeople,
    decimal TotalDeviations,
    decimal WeightedDeviationTotal,
    decimal LowSeverityDeviations,
    decimal MediumSeverityDeviations,
    decimal HighSeverityDeviations,
    IReadOnlyCollection<ConsolidationDayDto> Days,
    IReadOnlyCollection<ConsolidationCategoryDto> Categories,
    IReadOnlyCollection<ConsolidationItemDto> Items,
    string WeekGroupingStatus,
    IReadOnlyCollection<ConsolidationWeekdayDto> Weekdays,
    IReadOnlyCollection<ConsolidationWeekCategoryDto> WeeklyCategories,
    IReadOnlyCollection<ConsolidationWeekItemDto> WeeklyItems,
    ConsolidationReportMetadataDto Metadata);

public sealed record EvaluationDto(
    Guid Id,
    DateOnly EvaluationDate,
    TimeOnly? EvaluationTime,
    string Status,
    Guid? SiteId,
    Guid? ClientOrganizationId,
    Guid? ContractorOrganizationId,
    Guid? SubcontractorOrganizationId,
    string? Site,
    string? ProjectOrIsland,
    string? Client,
    string? Contractor,
    string? Subcontractor,
    string? LeadAuditorName,
    string? AuditorName,
    string? CompanionName,
    string? Strengths,
    string? ImprovementOpportunities,
    EvaluationIndicatorsDto Indicators,
    IReadOnlyCollection<EvaluationObservationDto> Observations,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    Guid? FormVersionId = null,
    string FormName = "Formulário padrão",
    int FormVersion = 0,
    Guid AreaId = default,
    string AreaName = IDS.Domain.Entities.InspectionArea.DefaultName,
    Guid FormId = default);

public sealed class EvaluationValidationException(IReadOnlyCollection<string> errors)
    : Exception("A avaliação contém dados inválidos.")
{
    public IReadOnlyCollection<string> Errors { get; } = errors;
}