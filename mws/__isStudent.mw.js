module.exports = ({ managers }) => {
    return ({ res, results, next }) => {
        const decoded = results['__longToken'];
        if (!decoded || decoded.role !== 'student') {
            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                errors: 'forbidden: student access required',
            });
        }
        next({ role: decoded.role, userId: decoded.userId, schoolId: decoded.schoolId });
    };
};
