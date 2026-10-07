import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { legacyBookingsFromSheets } from "@/lib/legacy-report";
import { readXlsxSheets } from "@/lib/xlsx";

function zip(files: Record<string, string>) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = deflateRawSync(Buffer.from(text));
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(Buffer.byteLength(text), 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const localHeader = Buffer.concat([local, nameBuf, data]);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(Buffer.byteLength(text), 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(localHeader);
    centrals.push(Buffer.concat([central, nameBuf]));
    offset += localHeader.length;
  }
  const centralDir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDir, end]);
}

describe("legacy revenue report", () => {
  it("reads booking rows from the old software workbook", () => {
    const sheet = `<?xml version="1.0"?><worksheet><sheetData>
      <row><c r="A1" t="inlineStr"><is><t>Bookings</t></is></c></row>
      <row>
        <c r="A2" t="inlineStr"><is><t>Booking ID</t></is></c>
        <c r="B2" t="inlineStr"><is><t>Station</t></is></c>
        <c r="C2" t="inlineStr"><is><t>Customer</t></is></c>
        <c r="E2" t="inlineStr"><is><t>Type</t></is></c>
        <c r="H2" t="inlineStr"><is><t>Actual Start</t></is></c>
        <c r="I2" t="inlineStr"><is><t>Actual End</t></is></c>
        <c r="J2" t="inlineStr"><is><t>Duration (min)</t></is></c>
        <c r="N2" t="inlineStr"><is><t>Total Amount</t></is></c>
        <c r="P2" t="inlineStr"><is><t>Collected</t></is></c>
        <c r="S2" t="inlineStr"><is><t>Payment Method</t></is></c>
        <c r="T2" t="inlineStr"><is><t>Payment Status</t></is></c>
      </row>
      <row>
        <c r="A3" t="inlineStr"><is><t>57e3247e-1959-437d-8f8f-f46d79f82d9a</t></is></c>
        <c r="B3" t="inlineStr"><is><t>S1</t></is></c>
        <c r="C3" t="inlineStr"><is><t>Ayyan</t></is></c>
        <c r="E3" t="inlineStr"><is><t>Future</t></is></c>
        <c r="H3" t="inlineStr"><is><t>2026-01-07 11:19</t></is></c>
        <c r="I3" t="inlineStr"><is><t>2026-01-07 11:50</t></is></c>
        <c r="J3"><v>30</v></c>
        <c r="N3"><v>100</v></c>
        <c r="P3"><v>100</v></c>
        <c r="S3" t="inlineStr"><is><t>Online</t></is></c>
        <c r="T3" t="inlineStr"><is><t>Partial</t></is></c>
      </row>
    </sheetData></worksheet>`;
    const workbook = `<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Jan-2026" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    const rels = `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
    const parsed = readXlsxSheets(zip({
      "xl/workbook.xml": workbook,
      "xl/_rels/workbook.xml.rels": rels,
      "xl/worksheets/sheet1.xml": sheet,
    }));
    const bookings = legacyBookingsFromSheets(parsed);
    expect(bookings).toEqual([
      expect.objectContaining({
        id: "57e3247e-1959-437d-8f8f-f46d79f82d9a",
        station: "S1",
        customer: "Ayyan",
        source: "reservation",
        start: "2026-01-07 11:19",
        durationMinutes: 30,
        totalAmount: 100,
        collected: 100,
        method: "other",
        paymentStatus: "partial",
      }),
    ]);
  });
});
