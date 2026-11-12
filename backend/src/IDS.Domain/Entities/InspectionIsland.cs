namespace IDS.Domain.Entities;

public sealed class InspectionIsland : TenantEntity
{
    public required string Name { get; set; }

    public bool IsActive { get; set; } = true;
}
