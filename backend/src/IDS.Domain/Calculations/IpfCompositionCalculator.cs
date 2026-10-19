namespace IDS.Domain.Calculations;

public sealed record IpfAreaInput(Guid AreaId, decimal Weight, IReadOnlyCollection<decimal?> Scores);
public sealed record IpfAreaResult(
    Guid AreaId, decimal Weight, decimal EffectiveWeight, decimal? Average,
    int EvaluationCount, int ScoredEvaluationCount, decimal? Contribution, string Status);
public sealed record IpfCompositionResult(decimal? Value, IReadOnlyCollection<IpfAreaResult> Areas);

public static class IpfCompositionCalculator
{
    public static IpfCompositionResult Calculate(IReadOnlyCollection<IpfAreaInput> areas)
    {
        ArgumentNullException.ThrowIfNull(areas);
        if (areas.Count is < 1 or > 4 || areas.Select(area => area.AreaId).Distinct().Count() != areas.Count
            || areas.Any(area => area.Weight is < 0 or > 100) || areas.Sum(area => area.Weight) != 100m)
        {
            throw new ArgumentException("Selecione de 1 a 4 áreas distintas, com pesos entre 0 e 100 e soma igual a 100.");
        }

        var averages = areas.Select(area =>
        {
            var scores = area.Scores.Where(score => score.HasValue).Select(score => score!.Value).ToArray();
            return (Area: area, Average: scores.Length == 0 ? (decimal?)null : scores.Average(), Count: scores.Length);
        }).ToArray();
        var participatingWeight = averages.Where(area => area.Average.HasValue && area.Area.Weight > 0)
            .Sum(area => area.Area.Weight);
        var results = averages.Select(area =>
        {
            var included = area.Average.HasValue && area.Area.Weight > 0;
            return new IpfAreaResult(area.Area.AreaId, area.Area.Weight,
                included ? area.Area.Weight * 100m / participatingWeight : 0m,
                area.Average, area.Area.Scores.Count, area.Count,
                included ? area.Average * area.Area.Weight / participatingWeight : null,
                area.Area.Weight == 0 ? "zero-weight" : included ? "included" : "no-average");
        }).ToArray();
        var value = participatingWeight == 0 ? (decimal?)null : decimal.Round(
            averages.Where(area => area.Average.HasValue && area.Area.Weight > 0)
                .Sum(area => area.Average!.Value * area.Area.Weight) / participatingWeight,
            4, MidpointRounding.AwayFromZero);
        return new(value, results);
    }
}
