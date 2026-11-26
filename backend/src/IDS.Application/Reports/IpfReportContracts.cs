using IDS.Domain.Entities;

namespace IDS.Application.Reports;

public sealed record UpsertMonthlyIpfRequest(
    Guid ContractorOrganizationId,
    Guid? SiteId,
    decimal Value,
    Guid? AreaId = null,
    Guid? FormId = null,
    decimal? MultiplicationFactor = null,
    decimal? AdditionalScore = null,
    bool UseDisciplineAverage = false);

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
    Guid? FormId = null,
    decimal? MultiplicationFactor = null,
    decimal? AdditionalScore = null,
    decimal? IdsAverage = null);

public sealed record IpfAnnualHistoryDto(
    int Year,
    Guid ContractorOrganizationId,
    string Contractor,
    decimal? AnnualAverage,
    IReadOnlyCollection<MonthlyIpfValueDto> Months,
    Guid? AreaId = null,
    Guid? FormId = null,
    string AreaName = InspectionArea.DefaultName,
    string FormName = "Formulário padrão",
    Guid? SiteId = null);

public sealed record MonthlyIpfSuggestionDto(
    int Year,
    int Month,
    Guid ContractorOrganizationId,
    decimal? Average,
    int EvaluationCount,
    int ScoredEvaluationCount,
    Guid? AreaId = null,
    Guid? FormId = null,
    Guid? SiteId = null);

/// <summary>Prévia calculada com os pesos atuais do projeto, não um fechamento salvo.</summary>
public sealed record ProjectIdsAverageDto(decimal? Value, IReadOnlyCollection<IDS.Domain.Calculations.IpfAreaResult> Areas);

/// <summary>Resultado da associação de registros gerais ao projeto.</summary>
public sealed record AssociateLegacyIpfResult(Guid SiteId, int Count, IReadOnlyCollection<LegacyIpfConflict> Conflicts);

/// <summary>Período e recorte que já possuem registro no projeto.</summary>
public sealed record LegacyIpfConflict(int Year, int Month, Guid? AreaId, Guid? FormId);

public sealed class IpfReportValidationException(IReadOnlyCollection<string> errors)
    : Exception("Os dados do relatório IPF são inválidos.")
{
    public IReadOnlyCollection<string> Errors { get; } = errors;
}