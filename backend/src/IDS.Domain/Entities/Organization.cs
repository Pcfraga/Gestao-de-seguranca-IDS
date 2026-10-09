namespace IDS.Domain.Entities;

public sealed class Organization : TenantEntity
{
    public required string Name { get; set; }

    public required OrganizationKind Kind { get; set; }
}

public enum OrganizationKind
{
    Client = 1,
    Contractor = 2,
    Subcontractor = 3
}