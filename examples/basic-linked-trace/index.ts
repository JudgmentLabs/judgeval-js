import { Tracer } from "judgeval";

const searchFlights = Tracer.observe(
  function _searchFlights(destination: string): string[] {
    return [
      `Morning flight to ${destination}`,
      `Evening flight to ${destination}`,
    ];
  },
  "tool",
);

const searchHotels = Tracer.observe(
  function _searchHotels(destination: string): string {
    return `Central hotel in ${destination}`;
  },
  "tool",
);

const planTransportAndLodging = Tracer.observe(
  function _planTransportAndLodging(destination: string): {
    flight: string;
    hotel: string;
  } {
    const flights = searchFlights(destination);
    const hotel = searchHotels(destination);
    return {
      flight: flights[0],
      hotel,
    };
  },
  "agent",
  undefined,
  undefined,
  undefined,
  undefined,
  true,
);

const buildTrip = Tracer.observe(
  function _buildTrip(destination: string): {
    destination: string;
    logistics: { flight: string; hotel: string };
    summary: string;
  } {
    Tracer.setSessionId("trip-session-1");
    Tracer.setCustomerId("customer-123");
    Tracer.setCustomerUserId("user-123");

    const logistics = planTransportAndLodging(destination);

    return {
      destination,
      logistics,
      summary: `Booked ${logistics.flight} and ${logistics.hotel}`,
    };
  },
  "agent",
);

async function main() {
  await Tracer.init({ projectName: "basic-linked-trace" });
  const trip = buildTrip("Paris");
  console.log(trip);
  await Tracer.forceFlush();
  await Tracer.shutdown();
}

main().catch(console.error);
