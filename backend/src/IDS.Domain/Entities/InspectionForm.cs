namespace IDS.Domain.Entities;

public sealed class InspectionForm : TenantEntity
{
    public bool IsDefault { get; set; }

    public int CurrentVersion { get; set; }

    public ICollection<InspectionFormVersion> Versions { get; set; } = [];
}
