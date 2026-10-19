using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IDS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddIpfCompositions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ipf_compositions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    Month = table.Column<int>(type: "integer", nullable: false),
                    ContractorOrganizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    ContractorName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Value = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ipf_compositions", x => x.Id);
                    table.CheckConstraint("ck_ipf_compositions_month", "\"Month\" BETWEEN 1 AND 12");
                    table.CheckConstraint("ck_ipf_compositions_year", "\"Year\" BETWEEN 2000 AND 2200");
                    table.ForeignKey(
                        name: "FK_ipf_compositions_organizations_ContractorOrganizationId",
                        column: x => x.ContractorOrganizationId,
                        principalTable: "organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ipf_compositions_tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ipf_composition_areas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompositionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    AreaId = table.Column<Guid>(type: "uuid", nullable: false),
                    AreaName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Weight = table.Column<decimal>(type: "numeric(28,16)", precision: 28, scale: 16, nullable: false),
                    EffectiveWeight = table.Column<decimal>(type: "numeric(28,16)", precision: 28, scale: 16, nullable: false),
                    Average = table.Column<decimal>(type: "numeric(28,16)", precision: 28, scale: 16, nullable: true),
                    EvaluationCount = table.Column<int>(type: "integer", nullable: false),
                    ScoredEvaluationCount = table.Column<int>(type: "integer", nullable: false),
                    Contribution = table.Column<decimal>(type: "numeric(28,16)", precision: 28, scale: 16, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ipf_composition_areas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ipf_composition_areas_ipf_compositions_CompositionId",
                        column: x => x.CompositionId,
                        principalTable: "ipf_compositions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ipf_composition_areas_tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ipf_composition_areas_CompositionId_AreaId",
                table: "ipf_composition_areas",
                columns: new[] { "CompositionId", "AreaId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ipf_composition_areas_TenantId",
                table: "ipf_composition_areas",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ipf_compositions_ContractorOrganizationId",
                table: "ipf_compositions",
                column: "ContractorOrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_ipf_compositions_TenantId_ContractorOrganizationId_Year_Mon~",
                table: "ipf_compositions",
                columns: new[] { "TenantId", "ContractorOrganizationId", "Year", "Month" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ipf_composition_areas");

            migrationBuilder.DropTable(
                name: "ipf_compositions");
        }
    }
}
