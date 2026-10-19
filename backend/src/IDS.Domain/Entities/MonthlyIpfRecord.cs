namespace IDS.Domain.Entities;

public sealed class MonthlyIpfRecord : TenantEntity
{
    public int Year { get; set; }

    public int Month { get; set; }

    public Guid ContractorOrganizationId { get; set; }

    public Organization ContractorOrganization { get; set; } = null!;

    public Guid? AreaId { get; set; }

    public Guid? FormId { get; set; }

    public Guid? SiteId { get; set; }

    public Site? Site { get; set; }

    public decimal Value { get; set; }

    public string Source { get; set; } = "Manual";
}