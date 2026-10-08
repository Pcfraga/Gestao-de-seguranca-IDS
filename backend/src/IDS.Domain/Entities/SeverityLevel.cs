namespace IDS.Domain.Entities;

public sealed class SeverityLevel : AuditableEntity
{
    public required string Name { get; set; }

    public decimal Weight { get; set; }

    public int SortOrder { get; set; }
}