exports.listAll = async (req, res) => {
  try {
    const db = req.app.locals.db;
    const colleges = await db.collection('community_colleges').find().toArray();
    res.json(colleges);
  } catch (error) {
    console.error('Error retrieving community colleges:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
