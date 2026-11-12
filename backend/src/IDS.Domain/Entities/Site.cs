namespace IDS.Domain.Entities;

public sealed class Site : TenantEntity
{
    public required string Name { get; set; }

    public string? ProjectOrIsland { get; set; }

    public bool IsActive { get; set; } = true;

    public Guid? CanonicalSiteId { get; set; }

    public Site? CanonicalSite { get; set; }
}