module.exports = {
    createClassroom: [
        { model: 'name',     required: true },
        { model: 'capacity', required: true },
        { model: 'resources', required: false },
    ],
    updateClassroom: [
        { model: 'name',     required: false },
        { model: 'capacity', required: false },
        { model: 'resources', required: false },
    ],
}
