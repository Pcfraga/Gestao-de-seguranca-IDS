namespace IDS.Domain.Entities;

public sealed class EvaluationObservation : TenantEntity
{
    public Guid EvaluationId { get; set; }

    public Evaluation Evaluation { get; set; } = null!;

    public Guid ChecklistItemId { get; set; }

    public ChecklistItem ChecklistItem { get; set; } = null!;

    public decimal? Quantity { get; set; }

    public Guid? SeverityLevelId { get; set; }

    public SeverityLevel? SeverityLevel { get; set; }

    public string? Comment { get; set; }
}