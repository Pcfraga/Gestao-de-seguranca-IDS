namespace IDS.Domain.Entities;

public sealed class IpfComposition : TenantEntity
{
    public int Year { get; set; }
    public int Month { get; set; }
    public Guid ContractorOrganizationId { get; set; }
    public Organization ContractorOrganization { get; set; } = null!;
    public string ContractorName { get; set; } = "";
    public decimal Value { get; set; }
    public ICollection<IpfCompositionArea> Areas { get; set; } = [];
}

public sealed class IpfCompositionArea : TenantEntity
{
    public Guid CompositionId { get; set; }
    public IpfComposition Composition { get; set; } = null!;
    public int Position { get; set; }
    public Guid AreaId { get; set; }
    public string AreaName { get; set; } = "";
    public decimal Weight { get; set; }
    public decimal EffectiveWeight { get; set; }
    public decimal? Average { get; set; }
    public int EvaluationCount { get; set; }
    public int ScoredEvaluationCount { get; set; }
    public decimal? Contribution { get; set; }
    public string Status { get; set; } = "";
}
