exports.getCoursesByCommunityCollegeId = async (req, res) => {
  try {
    const { community_college_id } = req.params;
    const db = req.app.locals.db;
    const courses = await db
      .collection('courses')
      .find({ community_college_id: Number(community_college_id) })
      .toArray();
    res.status(200).json(courses);
  } catch (err) {
    console.error('Error retrieving courses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
