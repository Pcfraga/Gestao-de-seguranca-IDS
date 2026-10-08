using Microsoft.AspNetCore.Identity;

namespace IDS.Infrastructure.Identity;

public sealed class IdsUser : IdentityUser<Guid>
{
    public string? DisplayName { get; set; }
}