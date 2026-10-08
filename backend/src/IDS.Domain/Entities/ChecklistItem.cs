namespace IDS.Domain.Entities;

public sealed class ChecklistItem : AuditableEntity
{
    public Guid CategoryId { get; set; }

    public ObservationCategory Category { get; set; } = null!;

    public required string Code { get; set; }

    public required string Name { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; } = true;
}