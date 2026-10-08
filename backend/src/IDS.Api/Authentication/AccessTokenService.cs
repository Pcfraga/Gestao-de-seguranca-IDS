using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using IDS.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;

namespace IDS.Api.Authentication;

public sealed class AccessTokenService(
    IConfiguration configuration,
    UserManager<IdsUser> userManager)
{
    public async Task<(string Token, DateTimeOffset ExpiresAt)> CreateAsync(
        IdsUser user,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var roles = await userManager.GetRolesAsync(user);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.DisplayName ?? user.UserName ?? user.Email ?? user.Id.ToString())
        };
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var expiresAt = DateTimeOffset.UtcNow.AddMinutes(30);
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(configuration["AUTH_SIGNING_KEY"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: configuration["AUTH_ISSUER"] ?? "IDS.Api",
            audience: configuration["AUTH_AUDIENCE"] ?? "IDS.Frontend",
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiresAt.UtcDateTime,
            signingCredentials: credentials);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }
}