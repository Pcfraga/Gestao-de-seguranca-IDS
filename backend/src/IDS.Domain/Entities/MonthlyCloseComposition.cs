namespace IDS.Domain.Entities;

public sealed class MonthlyCloseComposition : TenantEntity
{
    public Guid SiteId { get; set; }
    public Site Site { get; set; } = null!;
    public ICollection<MonthlyCloseCompositionArea> Areas { get; set; } = [];
}

public sealed class MonthlyCloseCompositionArea : TenantEntity
{
    public Guid CompositionId { get; set; }
    public MonthlyCloseComposition Composition { get; set; } = null!;
    public Guid AreaId { get; set; }
    public decimal Weight { get; set; }
}
