namespace IDS.Domain.Calculations;

public static class IdsCalculator
{
    private const decimal LowSeverityWeight = 0.3m;
    private const decimal MediumSeverityWeight = 1m;
    private const decimal HighSeverityWeight = 3m;

    public static IdsCalculationResult Calculate(
        IEnumerable<ObservationInput> observations,
        decimal observedPeople)
    {
        ArgumentNullException.ThrowIfNull(observations);

        var observationList = observations.ToArray();
        var lowSeverityCount = SumQuantityForWeight(observationList, LowSeverityWeight);
        var mediumSeverityCount = SumQuantityForWeight(observationList, MediumSeverityWeight);
        var highSeverityCount = SumQuantityForWeight(observationList, HighSeverityWeight);
        var totalDeviations = lowSeverityCount + mediumSeverityCount + highSeverityCount;
        var weightedDeviationTotal =
            (lowSeverityCount * LowSeverityWeight)
            + (mediumSeverityCount * MediumSeverityWeight)
            + (highSeverityCount * HighSeverityWeight);

        return new IdsCalculationResult(
            lowSeverityCount,
            mediumSeverityCount,
            highSeverityCount,
            totalDeviations,
            weightedDeviationTotal,
            observedPeople,
            observedPeople > 0 ? 1m - (weightedDeviationTotal / observedPeople) : null,
            CalculateShare(lowSeverityCount, totalDeviations),
            CalculateShare(mediumSeverityCount, totalDeviations),
            CalculateShare(highSeverityCount, totalDeviations));
    }

    private static decimal SumQuantityForWeight(
        IEnumerable<ObservationInput> observations,
        decimal severityWeight)
    {
        return observations
            .Where(observation => observation.SeverityWeight == severityWeight)
            .Sum(observation => observation.Quantity ?? 0m);
    }

    private static decimal? CalculateShare(decimal severityCount, decimal totalDeviations)
    {
        return severityCount > 0 ? severityCount / totalDeviations : null;
    }
}