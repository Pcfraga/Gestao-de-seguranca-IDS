namespace IDS.Domain.Entities;

public sealed class Evaluation : TenantEntity
{
    public DateOnly EvaluationDate { get; set; }

    public TimeOnly? EvaluationTime { get; set; }

    public Guid? SiteId { get; set; }

    public Site? Site { get; set; }

    public Guid? ClientOrganizationId { get; set; }

    public Organization? ClientOrganization { get; set; }

    public Guid? ContractorOrganizationId { get; set; }

    public Organization? ContractorOrganization { get; set; }

    public Guid? SubcontractorOrganizationId { get; set; }

    public Organization? SubcontractorOrganization { get; set; }

    public string? LeadAuditorName { get; set; }

    public string? AuditorName { get; set; }

    public string? CompanionName { get; set; }

    public decimal? ObservedPeople { get; set; }

    public string? Strengths { get; set; }

    public string? ImprovementOpportunities { get; set; }

    public EvaluationStatus Status { get; set; } = EvaluationStatus.Draft;

    public ICollection<EvaluationObservation> Observations { get; set; } = [];
}

public enum EvaluationStatus
{
    Draft = 1,
    Submitted = 2
}