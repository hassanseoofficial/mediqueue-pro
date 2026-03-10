/**
 * Room naming helpers — consistent across server and client.
 */

const queueRoom = (clinicId, doctorId) => `clinic:${clinicId}:doctor:${doctorId}:queue`;
const displayRoom = (clinicId, doctorId) => `clinic:${clinicId}:doctor:${doctorId}:display`;
const patientRoom = (tokenId) => `clinic:patient:${tokenId}`;
const adminRoom = (clinicId) => `clinic:${clinicId}:admin`;

module.exports = { queueRoom, displayRoom, patientRoom, adminRoom };
