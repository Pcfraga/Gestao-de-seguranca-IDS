using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IDS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMonthlyIpfHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "monthly_ipf_records",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    Month = table.Column<int>(type: "integer", nullable: false),
                    ContractorOrganizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    SiteId = table.Column<Guid>(type: "uuid", nullable: true),
                    Value = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    Source = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_monthly_ipf_records", x => x.Id);
                    table.CheckConstraint("ck_monthly_ipf_records_month", "\"Month\" BETWEEN 1 AND 12");
                    table.ForeignKey(
                        name: "FK_monthly_ipf_records_organizations_ContractorOrganizationId",
                        column: x => x.ContractorOrganizationId,
                        principalTable: "organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_monthly_ipf_records_sites_SiteId",
                        column: x => x.SiteId,
                        principalTable: "sites",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_monthly_ipf_records_ContractorOrganizationId_Year_Month",
                table: "monthly_ipf_records",
                columns: new[] { "ContractorOrganizationId", "Year", "Month" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_monthly_ipf_records_SiteId",
                table: "monthly_ipf_records",
                column: "SiteId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "monthly_ipf_records");
        }
    }
}
