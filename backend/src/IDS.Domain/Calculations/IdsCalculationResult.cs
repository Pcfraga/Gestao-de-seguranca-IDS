namespace IDS.Domain.Calculations;

public sealed record IdsCalculationResult(
    decimal LowSeverityCount,
    decimal MediumSeverityCount,
    decimal HighSeverityCount,
    decimal TotalDeviations,
    decimal WeightedDeviationTotal,
    decimal ObservedPeople,
    decimal? Score,
    decimal? LowSeverityShare,
    decimal? MediumSeverityShare,
    decimal? HighSeverityShare);