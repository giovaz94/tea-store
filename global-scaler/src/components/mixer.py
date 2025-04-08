class Mixer:

    def __init__(self, error_limit, scores):
        self.errors = [] 
        self.error_limit = error_limit
        self.scores = scores

    def __compute_diff__(self, pred_conf, actual_conf):
        diff = []
        for i in range(len(pred_conf)):
            diff.append(pred_conf[i] - actual_conf[i])
        return diff
    
    def __compute_weight__(self, pred_conf, actual_conf):
        curr_weight = 0.0
        diffs = self.__compute_diff__(pred_conf, actual_conf)
        for i in range(len(pred_conf)):
            curr_weight += abs(diffs[i] * self.scores[i])
        return min(curr_weight, 1)
    
    def __store_weight__(self, weight): 
        self.errors.append(weight)
        if len(self.errors) > self.error_limit: self.errors.remove(self.errors[0])

    def __compute_distance(self):
        num = 0.0
        den = 0.0
        for i in range(len(self.errors)):
            num += self.errors[i] * (i + 1)
            den += i + 1
        return num/den 
    
    def mix(self, measured, predicted, pred_conf, actual_conf):
        curr_weight = self.__compute_weight__(pred_conf, actual_conf)
        self.__store_weight__(curr_weight)
        react_score = self.__compute_distance()
        pred_score = 1 - react_score
        target = (react_score * measured) + (pred_score * predicted)
        return target

            

