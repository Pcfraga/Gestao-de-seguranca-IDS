namespace IDS.Domain.Entities;

public sealed class InspectionFormVersion : TenantEntity
{
    public Guid FormId { get; set; }

    public InspectionForm Form { get; set; } = null!;

    public int Version { get; set; }

    public required string Name { get; set; }

    public Guid? AreaId { get; set; }

    public InspectionArea? Area { get; set; }

    public string AreaName { get; set; } = InspectionArea.DefaultName;

    public ICollection<ObservationCategory> Categories { get; set; } = [];
}
