namespace IDS.Domain.Entities;

public sealed class ObservationCategory : TenantCatalogEntity
{
    public Guid? FormVersionId { get; set; }

    public InspectionFormVersion? FormVersion { get; set; }

    public required string Code { get; set; }

    public required string Name { get; set; }

    public int SortOrder { get; set; }

    public ICollection<ChecklistItem> Items { get; set; } = [];
}