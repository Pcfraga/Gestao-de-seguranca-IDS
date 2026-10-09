namespace IDS.Domain.Entities;

public sealed class AuditEvent : TenantEntity
{
    public required string Action { get; set; }

    public required string EntityType { get; set; }

    public required string EntityId { get; set; }

    public string? ActorUserId { get; set; }

    public string? CorrelationId { get; set; }
}