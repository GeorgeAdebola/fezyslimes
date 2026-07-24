/**
 * Shipping Service Abstraction Layer
 * 
 * This module defines the interface for calculating rates and booking shipments
 * with couriers (DHL, Uber, Gokada). Currently, it operates using manual flat-rate
 * fulfillment and generates no fake data, but it is structured to allow live API integrations 
 * to be plugged in directly inside the courier-specific blocks without altering storefront checkout 
 * or order persistence schemas.
 */

/**
 * Calculates the shipping quote for a courier and address.
 * 
 * @param {string} courier - The courier selection ('Uber', 'Gokada', 'DHL')
 * @param {object} address - Customer address details { streetAddress, city, state }
 * @param {number} baseRate - The active flat rate fetched from the settings collection in Firestore
 * @returns {Promise<number>} The final shipping cost
 */
async function getShippingQuote(courier, address, baseRate) {
  console.log(`[ShippingService] Requesting quote for Courier: ${courier}, Address State: ${address.state || 'N/A'}`);
  
  switch (courier?.toUpperCase()) {
    case 'UBER':
      // TODO: Implement Uber Direct API call here in the future:
      // const uberResponse = await axios.post('https://api.uber.com/v1/deliveries', { ... });
      // return uberResponse.data.fee;
      break;

    case 'GOKADA':
      // TODO: Implement Gokada API quote request here in the future:
      // const gokadaResponse = await axios.post('https://api.gokada.co/api/v1/quotes', { ... });
      // return gokadaResponse.data.amount;
      break;

    case 'DHL':
      // TODO: Implement DHL Express Rate API call here in the future:
      // const dhlResponse = await axios.post('https://express.api.dhl.com/mydhlapi/test/rates', { ... });
      // return dhlResponse.data.totalNetCharge;
      break;

    default:
      console.warn(`[ShippingService] Unknown courier '${courier}'. Falling back to default rate.`);
  }

  // Manual/Flat-rate fulfillment fallback: return the rate configured in the database
  return baseRate;
}

/**
 * Books a live shipment with the selected courier and returns tracking metadata.
 * 
 * @param {string} courier - The courier selection ('Uber', 'Gokada', 'DHL')
 * @param {object} order - Complete order data including customer info and cart items
 * @returns {Promise<object>} The shipment status and tracking details (if any)
 */
async function createShipment(courier, order) {
  console.log(`[ShippingService] Booking shipment with Courier: ${courier} for Order: ${order.orderId}`);

  switch (courier?.toUpperCase()) {
    case 'UBER':
      // TODO: Call Uber Direct delivery creation endpoint:
      // const booking = await axios.post('https://api.uber.com/v1/deliveries/create', { ... });
      // return { trackingId: booking.data.tracking_id, status: 'Processing' };
      break;

    case 'GOKADA':
      // TODO: Call Gokada delivery creation endpoint:
      // const booking = await axios.post('https://api.gokada.co/api/v1/orders', { ... });
      // return { trackingId: booking.data.tracking_code, status: 'Processing' };
      break;

    case 'DHL':
      // TODO: Call DHL Express Shipment Creation API:
      // const booking = await axios.post('https://express.api.dhl.com/mydhlapi/test/shipments', { ... });
      // return { trackingId: booking.data.shipmentTrackingNumber, status: 'Processing' };
      break;

    default:
      console.warn(`[ShippingService] Unknown courier '${courier}' for booking.`);
  }

  // Flat-rate manual fulfillment: do not call any API or generate fake tracking number.
  // The trackingId remains null/empty until the admin manually books a courier and enters it.
  return {
    trackingId: null,
    status: 'Processing'
  };
}

module.exports = {
  getShippingQuote,
  createShipment
};
