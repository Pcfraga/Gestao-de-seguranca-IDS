namespace IDS.Domain.Entities;

public sealed class Site : TenantEntity
{
    public required string Name { get; set; }

    public string? ProjectOrIsland { get; set; }
}