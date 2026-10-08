const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/gomookambika');
  const q = await mongoose.connection.collection('queueentries').find({ status: 'WAITING' }).toArray();
  console.log('Waiting queue entries count:', q.length);
  q.forEach(x => console.log('Queue entry:', { id: x._id, driver: x.driverId, stand: x.taxiStandId, pos: x.position, cat: x.vehicleCategoryId }));
  
  const stands = await mongoose.connection.collection('taxistands').find({}).toArray();
  console.log('Stands count:', stands.length);
  stands.forEach(s => console.log('Stand:', { id: s._id, name: s.name, qrToken: s.qrToken }));

  const drivers = await mongoose.connection.collection('drivers').find({}).toArray();
  console.log('Drivers count:', drivers.length);
  drivers.forEach(d => console.log('Driver:', { id: d._id, name: d.name, phone: d.phone, status: d.status, code: d.driverCode }));

  const categories = await mongoose.connection.collection('vehiclecategories').find({}).toArray();
  console.log('Categories count:', categories.length);
  categories.forEach(c => console.log('Category:', { id: c._id, name: c.name, code: c.code }));

  await mongoose.disconnect();
}

run().catch(console.error);
