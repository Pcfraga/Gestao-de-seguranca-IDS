using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IDS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LinkCanonicalProjects : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_sites_CanonicalSiteId",
                table: "sites",
                column: "CanonicalSiteId");

            migrationBuilder.AddForeignKey(
                name: "FK_sites_sites_CanonicalSiteId",
                table: "sites",
                column: "CanonicalSiteId",
                principalTable: "sites",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_sites_sites_CanonicalSiteId",
                table: "sites");

            migrationBuilder.DropIndex(
                name: "IX_sites_CanonicalSiteId",
                table: "sites");
        }
    }
}
