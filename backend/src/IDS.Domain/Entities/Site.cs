namespace IDS.Domain.Entities;

public sealed class Site : AuditableEntity
{
    public required string Name { get; set; }

    public string? ProjectOrIsland { get; set; }
}