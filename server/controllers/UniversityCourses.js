exports.getUniversityCoursesByUniversityId = async (req, res) => {
  try {
    const { university_id } = req.params;
    const db = req.app.locals.db;
    const courses = await db
      .collection('university_courses')
      .find({ university_id: Number(university_id) })
      .toArray();
    res.status(200).json(courses);
  } catch (err) {
    console.error('Error retrieving university courses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
