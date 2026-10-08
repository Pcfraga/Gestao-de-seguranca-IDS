namespace IDS.Domain.Entities;

public abstract class AuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset UpdatedAtUtc { get; set; }

    public string? CreatedByUserId { get; set; }

    public string? UpdatedByUserId { get; set; }
}