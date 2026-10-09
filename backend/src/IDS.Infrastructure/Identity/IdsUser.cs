using Microsoft.AspNetCore.Identity;

namespace IDS.Infrastructure.Identity;

public sealed class IdsUser : IdentityUser<Guid>
{
    public Guid TenantId { get; set; }

    public string? DisplayName { get; set; }
}