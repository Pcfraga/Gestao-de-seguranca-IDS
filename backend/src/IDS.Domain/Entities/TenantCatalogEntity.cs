namespace IDS.Domain.Entities;

public abstract class TenantCatalogEntity : AuditableEntity
{
    public Guid? TenantId { get; set; }
}
