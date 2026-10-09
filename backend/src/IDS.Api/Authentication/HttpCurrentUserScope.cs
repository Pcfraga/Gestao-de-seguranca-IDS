using System.Security.Claims;
using IDS.Infrastructure.Persistence;

namespace IDS.Api.Authentication;

public sealed class HttpCurrentUserScope(IHttpContextAccessor accessor) : ICurrentUserScope
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public string? UserId => Principal?.FindFirstValue(ClaimTypes.NameIdentifier);

    public Guid? TenantId => Guid.TryParse(Principal?.FindFirstValue("tenant_id"), out var id) ? id : null;

    public bool IsAdministrator => Principal?.IsInRole("ADMINISTRADOR") == true;
}
