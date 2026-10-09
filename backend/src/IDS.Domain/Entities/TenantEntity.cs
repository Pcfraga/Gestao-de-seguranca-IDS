namespace IDS.Domain.Entities;

public abstract class TenantEntity : AuditableEntity
{
    public Guid TenantId { get; set; }
}
